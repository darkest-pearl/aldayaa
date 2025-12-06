/**
 * Upload a buffer to Cloudinary and return the secure URL.
 * @param {Blob | File | Buffer} fileBuffer - File buffer to upload.
 * @param {string} fileName - Name used for the uploaded asset.
 * @returns {Promise<string | null>} Secure URL or null when disabled.
 */
export async function uploadToCloudinary(fileBuffer, fileName) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn("Cloudinary env vars missing, skipping upload");
    return null;
  }

  if (!fileBuffer || !fileName) {
    console.error("Invalid upload payload provided to Cloudinary");
    return null;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = require("crypto")
      .createHash("sha1")
      .update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
      .digest("hex");

    const formData = new FormData();
    formData.append("file", fileBuffer, fileName);
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "Unable to read response body");
      throw new Error(`Cloudinary upload failed: ${res.status} ${errorBody}`);
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error("Failed to upload to Cloudinary", error);
    return null;
  }
}