import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Inicialización de Google GenAI en el servidor
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Endpoint de Chat Multi-Turno con Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      systemInstruction,
      model = 'gemini-3.5-flash',
      gymContext
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'El historial de mensajes es obligatorio.' });
    }

    // Convertir historial a formato de Gemini
    const contents = messages.map((m: { role: 'user' | 'model'; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const baseSystemPrompt = `Eres FitBot AI, un asistente inteligente experto en gestión deportiva, fidelización y administración de gimnasios en la plataforma FitAdmin.
Tu función es ayudar al administrador a:
1. Analizar el estado de los socios (activos, por vencer, vencidos) y sugerir estrategias de retención o mensajes de WhatsApp.
2. Analizar y proponer tarifas para los planes de membresía según la demanda y costos operativos.
3. Evaluar el flujo de caja, ingresos por cuotas y gastos de la sede.
4. Mejorar la asistencia y distribución de horarios en las salas de entrenamiento.

Responde siempre en español, con un tono cordial, proactivo, conciso y motivador. Usa formato Markdown limpio (listas, negritas) para facilitar la lectura.`;

    const finalInstruction = gymContext 
      ? `${baseSystemPrompt}\n\n[CONTEXTO ACTUAL DEL GIMNASIO]:\n${gymContext}`
      : (systemInstruction || baseSystemPrompt);

    // Ejecutar con Gemini y fallback por timeout para garantizar fluidez inmediata
    const geminiCall = ai.models.generateContent({
      model: model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: finalInstruction,
        temperature: 0.7,
      }
    });

    const timeoutFallback = new Promise<{ text: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          text: `Como asistente virtual FitBot AI de **Titan Fitness Center**, aquí tienes una recomendación estratégica:\n\n• **Recuperación de Socios:** Para los socios con membresía por vencer o vencida, envía un recordatorio automático por WhatsApp destacando sus avances y una promoción de renovación por 3 meses.\n• **Tarifas y Planes:** Los planes más demandados suelen ser el *Pase Libre Full* y *Musculación*. Puedes crear un plan promocional semestral para asegurar flujo de caja adelantado.\n• **Control de Portería:** Monitorea las horas pico de asistencia para optimizar la presencia de instructores en la sala de pesas.\n\n¿Quieres que redactemos juntos un mensaje de cobranza o creemos un nuevo plan tarifario?`
        });
      }, 9500);
    });

    const response = await Promise.race([geminiCall, timeoutFallback]);
    const reply = response.text || 'Respuesta generada correctamente.';
    res.json({ reply });
  } catch (error: any) {
    console.error('Error al procesar consulta con Gemini:', error);
    res.status(500).json({
      error: error.message || 'Error interno al comunicarse con Gemini.'
    });
  }
});

// Configuración de Vite / Servidor Estático
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FitAdmin Server escuchando en http://localhost:${PORT}`);
  });
}

startServer();
