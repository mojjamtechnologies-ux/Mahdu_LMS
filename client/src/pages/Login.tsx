import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { homeFor } from "../auth/guards";
import { AuthLayout } from "../components/AuthLayout";
import { Alert, Button, Field } from "../components/ui";
import { fieldErrors, messageOf } from "../lib/forms";
import PortalFooter from "../components/PortalFooter";
import Logo from "../components/Logo";

export default function Login() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const user = await login(email, password);
      navigate(
        from && (from.startsWith(`/${user.role}`) || from.startsWith("/id/")) ? from : homeFor(user.role),
        { replace: true },
      );
    } catch (err) {
      setFields(fieldErrors(err));
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t("signIn.title")}
      intro={t("signIn.intro")}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field
          label={t("signIn.email")}
          type="email"
          autoComplete="username"
          dir="ltr"
          value={email}
          error={fields.email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label={t("signIn.password")}
          type="password"
          autoComplete="current-password"
          value={password}
          error={fields.password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={busy}>
          {t("signIn.submit")}
        </Button>
        <p className="text-sm">
          <Link
            className="font-medium text-brand-700 underline"
            to="/forgot-password"
          >
            {t("signIn.forgot")}
          </Link>
        </p>
      </form>
      <PortalFooter />
    </AuthLayout>
  );
}
