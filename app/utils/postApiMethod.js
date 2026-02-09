class ApiError extends Error {
  constructor(message, statusCode, encryptedData) {
    super(message);
    this.statusCode = statusCode;
    this.encryptedData = encryptedData;
  }
}

export { ApiError };

export const postApi = async (url, payload) => {
  const baseUrl = "https://maria-subsidizable-maximina.ngrok-free.dev";
  const token = sessionStorage.getItem("authtoken");
  // console.log("envurl", process.env.REACT_APP_BASE_URL);
  const fullUrl = `${baseUrl}/${url}`;
  // const fullUrl = `/api/${url}`; // Use the Vercel proxy here

  const isFormData = payload instanceof FormData;

  const headers = {
    Authorization: `${token}`,
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      headers,
      body: isFormData ? payload : JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      // Return the successful result (with JWT and user details)
      return result;
    } else {
      // Throw an error with the message from the response
      // throw new Error(result.error?.message || "Something went wrong");
      // throw new Error(result || "Failed to fetch data");
      throw new ApiError(
        result.message || "Failed to fetch data",
        result.statusCode,
        result.encryptedData,
      );
    }
  } catch (error) {
    // Catch network or other errors
    // throw new Error(error || "Network error");
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || "Network error", 500, null);
  }
};
