import type { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  aiBackendTools,
  processPatientMessageWithAI,
} from '../../src/lib/aiReceptionistEngine';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { errorResponse, jsonResponse } from './_shared/security';

const chatRequestSchema = z.object({
  patientPhone: z.string().min(7).default('+15559990000'),
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().optional(),
});

const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getClinicInformation',
      description: 'Get verified clinic address, phone numbers, email, and policies.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getClinicOpeningHours',
      description: 'Get clinic opening hours by day of week and upcoming clinic holidays.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getClinicServices',
      description: 'List active dental treatments, durations, and prices.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailableDoctors',
      description: 'List active doctors optionally filtered by serviceId or specialization.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          specialization: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDoctorDetails',
      description: 'Get detailed profile and working hours for a specific doctor.',
      parameters: {
        type: 'object',
        properties: {
          doctorId: { type: 'string' },
          doctorName: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailableSlots',
      description: 'Get actual available appointment slots for a date (YYYY-MM-DD).',
      parameters: {
        type: 'object',
        required: ['date'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          doctorId: { type: 'string' },
          serviceId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createAppointment',
      description:
        'Book an appointment ONLY after checking availability and receiving explicit patient confirmation.',
      parameters: {
        type: 'object',
        required: [
          'patientName',
          'patientPhone',
          'appointmentDate',
          'startTime',
          'visitReason',
          'patientConfirmed',
        ],
        properties: {
          patientName: { type: 'string' },
          patientPhone: { type: 'string' },
          doctorId: { type: 'string' },
          serviceId: { type: 'string' },
          serviceName: { type: 'string' },
          appointmentDate: { type: 'string', description: 'YYYY-MM-DD' },
          startTime: { type: 'string', description: 'HH:mm (24-hour)' },
          visitReason: { type: 'string' },
          patientConfirmed: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAppointmentDetails',
      description: 'Look up existing appointment details by appointmentId or patientPhone.',
      parameters: {
        type: 'object',
        properties: {
          appointmentId: { type: 'string' },
          patientPhone: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelAppointment',
      description: 'Cancel an existing appointment verified by patientPhone.',
      parameters: {
        type: 'object',
        required: ['appointmentId', 'patientPhone'],
        properties: {
          appointmentId: { type: 'string' },
          patientPhone: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rescheduleAppointment',
      description: 'Reschedule an existing appointment to a new available date and startTime.',
      parameters: {
        type: 'object',
        required: ['appointmentId', 'patientPhone', 'newDate', 'newStartTime'],
        properties: {
          appointmentId: { type: 'string' },
          patientPhone: { type: 'string' },
          newDate: { type: 'string' },
          newStartTime: { type: 'string' },
          doctorId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferToHuman',
      description: 'Escalate the conversation to a human receptionist and pause AI responses.',
      parameters: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string' },
          urgency: { type: 'string', enum: ['normal', 'high', 'emergency'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPatientAppointmentHistory',
      description: 'Retrieve appointment history for the patient phone number.',
      parameters: {
        type: 'object',
        required: ['patientPhone'],
        properties: {
          patientPhone: { type: 'string' },
        },
      },
    },
  },
];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const parsed = chatRequestSchema.parse(JSON.parse(event.body || '{}'));
    const openAiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
    const isGroqKey = Boolean(openAiKey && openAiKey.startsWith('gsk_'));
    const baseURL =
      process.env.OPENAI_BASE_URL ||
      (isGroqKey ? 'https://api.groq.com/openai/v1' : undefined);
    const model =
      process.env.OPENAI_MODEL ||
      (isGroqKey ? 'openai/gpt-oss-120b' : 'gpt-4o-mini');

    // If OPENAI_API_KEY or GROQ_API_KEY is configured, execute OpenAI-compatible tool-calling loop with Zod backend validation
    if (openAiKey) {
      const client = new OpenAI({
        apiKey: openAiKey,
        ...(baseURL ? { baseURL } : {}),
      });
      const { aiConfig, clinic } = clinicStore.getState();

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `${aiConfig.systemPrompt}\nClinic Name: ${clinic.name}\nCurrent Date: ${new Date().toISOString().slice(0, 10)}\nPatient Phone: ${parsed.patientPhone}\nNever diagnose medical conditions or invent availability.`,
        },
        {
          role: 'user',
          content: parsed.message,
        },
      ];

      const executedTools: Array<{ toolName: string; args: unknown; output: unknown }> = [];

      const firstCompletion = await client.chat.completions.create({
        model,
        messages,
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
      });

      const assistantMsg = firstCompletion.choices[0]?.message;
      if (assistantMsg?.tool_calls?.length) {
        messages.push(assistantMsg);

        for (const tc of assistantMsg.tool_calls) {
          const fnName = tc.function.name as keyof typeof aiBackendTools;
          const rawArgs = JSON.parse(tc.function.arguments || '{}');
          const toolFn = aiBackendTools[fnName];
          const toolOutput = toolFn
            ? toolFn(rawArgs, parsed.conversationId)
            : { error: `Unknown tool ${fnName}` };

          executedTools.push({
            toolName: fnName,
            args: rawArgs,
            output: toolOutput,
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolOutput),
          });
        }

        const finalCompletion = await client.chat.completions.create({
          model,
          messages,
        });

        return jsonResponse(200, {
          success: true,
          mode: 'openai_live',
          reply: finalCompletion.choices[0]?.message?.content || '',
          toolsExecuted: executedTools,
        });
      }

      return jsonResponse(200, {
        success: true,
        mode: 'openai_live',
        reply: assistantMsg?.content || '',
        toolsExecuted: [],
      });
    }

    // Fallback to deterministic backend tool-calling state machine when OPENAI_API_KEY is not yet set
    const response = processPatientMessageWithAI({
      patientPhone: parsed.patientPhone,
      messageText: parsed.message,
      conversationId: parsed.conversationId,
    });

    return jsonResponse(200, {
      success: true,
      mode: 'validated_tool_engine',
      ...response,
    });
  } catch (err) {
    return errorResponse(
      400,
      err instanceof Error ? err.message : 'AI request validation failed',
      'AI_ERROR'
    );
  }
};
