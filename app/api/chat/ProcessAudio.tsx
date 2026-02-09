import { useState } from "react";
import { postApi, ApiError } from "../../utils/postApiMethod";

/**
 * Real API response from ngrok audio endpoint
 * Adjust if backend fields differ slightly
 */
export interface ProcessAudioResponse {
  transcript?: string;
  audio?: string;
  language?: string;
  response?: string;
  processing_info?: any;
}

const useProcessAudio = () => {
  const [processAudioResponse, setProcessAudioResponse] =
    useState<ProcessAudioResponse | null>(null);

  const [processAudioResponseLoading, setProcessAudioResponseLoading] =
    useState<boolean>(false);

  const createProcessAudio = async (
    url: string,
    payload: FormData,
  ): Promise<void> => {
    setProcessAudioResponseLoading(true);

    try {
      // ngrok returns DIRECT JSON
      const response = (await postApi(url, payload)) as ProcessAudioResponse;

      console.log("AUDIO API RESPONSE:", response);

      setProcessAudioResponse(response);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        console.error("API Error:", error.message, error.statusCode);
      } else if (error instanceof Error) {
        console.error("Unexpected Error:", error.message);
      } else {
        console.error("Unknown Error:", error);
      }
    } finally {
      setProcessAudioResponseLoading(false);
    }
  };

  return {
    createProcessAudio,
    processAudioResponse,
    processAudioResponseLoading,
  };
};

export default useProcessAudio;
