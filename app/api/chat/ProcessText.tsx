import { useState } from "react";
import { postApi, ApiError } from "../../utils/postApiMethod";

/**
 * Real API response from ngrok / FastAPI
 */
export interface ProcessTextResponse {
  audio: string;
  language: string;
  response: string;
  processing_info: any;
}

/**
 * Payload you send to API
 */
export interface ProcessTextPayload {
  text: string;
  sessionId?: string;
}

const useProcessText = () => {
  const [processTextResponse, setProcessTextResponse] =
    useState<ProcessTextResponse | null>(null);

  const [processTextResponseLoading, setProcessTextResponseLoading] =
    useState<boolean>(false);

  const createProcessText = async (
    url: string,
    payload: ProcessTextPayload,
  ): Promise<void> => {
    setProcessTextResponseLoading(true);

    try {
      // ngrok API returns DIRECT JSON (not wrapped)
      const response = (await postApi(url, payload)) as ProcessTextResponse;

      console.log("API RESPONSE:", response);

      // store directly
      setProcessTextResponse(response);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        console.error("API Error:", error.message, error.statusCode);
      } else if (error instanceof Error) {
        console.error("Unexpected Error:", error.message);
      } else {
        console.error("Unknown Error:", error);
      }
    } finally {
      setProcessTextResponseLoading(false);
    }
  };

  return {
    createProcessText,
    processTextResponse,
    processTextResponseLoading,
  };
};

export default useProcessText;
