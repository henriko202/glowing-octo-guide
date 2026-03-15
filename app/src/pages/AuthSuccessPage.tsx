import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Store userId for session tracking, then redirect to feed
    const userId = params.get("userId");
    if (userId) {
      sessionStorage.setItem("convexUserId", userId);
    }
    navigate("/feed", { replace: true });
  }, [params, navigate]);

  return <div style={{ padding: 32 }}>Signing you in...</div>;
}
