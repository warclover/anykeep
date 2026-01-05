/**
 * TTS WebSocket 测试端点
 *
 * GET /api/tts/test - 测试 WebSocket 连接
 */

import { NextResponse } from "next/server";
import WebSocket from "ws";

const DASHSCOPE_WS_ENDPOINT =
  "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

export async function GET() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: "DASHSCOPE_API_KEY not configured",
      envKeys: Object.keys(process.env).filter((k) => k.includes("DASHSCOPE")),
    });
  }

  return new Promise<Response>((resolve) => {
    const taskId = `test-${Date.now()}`;
    let audioSize = 0;
    const events: string[] = [];

    const ws = new WebSocket(DASHSCOPE_WS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const timeout = setTimeout(() => {
      events.push("timeout-10s");
      ws.close();
      resolve(
        NextResponse.json({
          success: false,
          error: "Connection timeout after 10s",
          events,
          audioSize,
        }),
      );
    }, 10000);

    ws.on("open", () => {
      events.push("connected");

      const message = {
        header: {
          action: "run-task",
          task_id: taskId,
          streaming: "out",
        },
        payload: {
          task_group: "audio",
          task: "tts",
          function: "SpeechSynthesizer",
          model: "cosyvoice-v2",
          parameters: {
            voice: "longxiaochun_v2",
            format: "mp3",
            sample_rate: 22050,
          },
          input: {
            text: "测试",
          },
        },
      };

      ws.send(JSON.stringify(message));
      events.push("sent-run-task");
    });

    ws.on("message", (data: Buffer | string) => {
      if (Buffer.isBuffer(data)) {
        const str = data.toString();
        if (str.startsWith("{")) {
          try {
            const msg = JSON.parse(str);
            const event = msg.header?.event || "unknown";
            events.push(`event:${event}`);

            if (event === "task-finished") {
              clearTimeout(timeout);
              ws.close();
              resolve(
                NextResponse.json({
                  success: true,
                  events,
                  audioSize,
                  message: "TTS WebSocket working correctly",
                }),
              );
            } else if (event === "task-failed") {
              clearTimeout(timeout);
              ws.close();
              resolve(
                NextResponse.json({
                  success: false,
                  error: `Task failed: ${msg.header?.error_code} - ${msg.header?.error_message}`,
                  events,
                }),
              );
            }
            return;
          } catch {
            // Not JSON, audio data
          }
        }
        audioSize += data.length;
        events.push(`audio-chunk:${data.length}`);
      }
    });

    ws.on("error", (error: Error) => {
      clearTimeout(timeout);
      events.push(`error:${error.message}`);
      resolve(
        NextResponse.json({
          success: false,
          error: error.message,
          events,
        }),
      );
    });

    ws.on("close", (code: number, reason: Buffer) => {
      events.push(`close:${code}:${reason.toString()}`);
    });
  });
}
