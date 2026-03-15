import { useTranslation } from "react-i18next";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const AUTH_URL = `${CONVEX_URL}/auth/linkedin`;

export default function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t("login.title")}</h1>
        <p className="text-gray-500">{t("login.tagline")}</p>
        <a
          href={AUTH_URL}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#0077B5] text-white rounded-lg font-medium hover:bg-[#005885] transition-colors"
        >
          {t("login.signInButton")}
        </a>
      </div>
    </div>
  );
}
