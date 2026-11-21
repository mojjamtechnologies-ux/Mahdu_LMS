import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/ui";
import ProfileCard from "../../components/ProfileCard";

export default function ProfilePage() {
  const { t } = useTranslation("profile");
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <ProfileCard />
    </>
  );
}
