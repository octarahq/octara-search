import { NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/config/auth-config";

export async function POST(request: Request) {
  const { code, redirect_uri } = await request.json();

  const CLIENT_ID = AUTH_CONFIG.clientId;
  const CLIENT_SECRET = AUTH_CONFIG.clientSecret;

  try {
    const baseUrl = process.env.ACCOUNT_API_BASE_URL || "https://octara.xyz";
    const response = await fetch(`${baseUrl}/api/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    try {
      const profileResponse = await fetch(`${baseUrl}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        data.user = {
          id: profileData.user.id,
          name: profileData.user.name,
          email: profileData.user.email,
          avatarURL: profileData.user.avatarURL,
        };
      }
    } catch (profileError) {
      console.error("Failed to fetch user profile:", profileError);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 },
    );
  }
}
