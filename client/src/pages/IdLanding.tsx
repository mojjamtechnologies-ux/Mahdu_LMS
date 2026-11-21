import { Navigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { homeFor } from "../auth/guards";

// The address a phone's camera opens when it reads a card's QR code. A card only identifies; it never signs anyone in:
//  - signed in as an administrator: the card is looked up in the scanner
//  - signed in as anyone else: sent to their own portal and nothing about the card is shown
//  - not signed in: sent to the normal sign-in page, then brought back here
export default function IdLanding() {
  const { t } = useTranslation("idcards");
  const { code } = useParams();
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="p-8 text-muted">{t("landing.checking")}</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.role === "admin") return <Navigate to={`/admin/id-scanner?code=${encodeURIComponent(code ?? "")}`} replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}
