export const getApi = async (url) => {
  const baseUrl = "https://maria-subsidizable-maximina.ngrok-free.dev";
  const token = sessionStorage.getItem("authtoken");

  let fullUrl = `${baseUrl}/${url}`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `${token}`,
    // size: 8000,
  };

  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      headers,
    });

    const result = await response.json();

    if (response.ok) {
      return result;
    } else {
      throw new Error(result?.message || "Failed to fetch data");
    }
  } catch (error) {
    console.error("Error in getApi:", error);
    throw error;
  }
};
