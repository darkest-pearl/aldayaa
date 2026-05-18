import crypto from "crypto";

/**
 * Upload a buffer to Cloudinary and return the secure URL.
 * @param {Blob | File | Buffer} fileBuffer
 * @param {string} fileName
 * @returns {Promise<string | null>}
 */
export async function uploadToCloudinary(fileBuffer, fileName) {
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

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

    // Convert to base64 (safe for Node + Vercel)
    let buffer;
    if (Buffer.isBuffer(fileBuffer)) {
      buffer = fileBuffer;
    } else {
      buffer = Buffer.from(await fileBuffer.arrayBuffer());
    }

    const base64File = `data:application/octet-stream;base64,${buffer.toString(
      "base64"
    )}`;

    // Sign parameters (sorted)
    const signature = crypto
      .createHash("sha1")
      .update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
      .digest("hex");

    const formData = new FormData();
    formData.append("file", base64File);
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `Cloudinary upload failed: ${res.status} ${errorBody}`
      );
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error("Failed to upload to Cloudinary", error);
    return null;
  }
}
