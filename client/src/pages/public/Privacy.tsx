import { Block, Page } from "./Shared";
import { usePageTitle } from "../../lib/usePageTitle";
import { useTranslation } from "react-i18next";

// Plain statements of what this website actually does. The school should have a lawyer review this before launch.
export default function Privacy() {
  const { t } = useTranslation("public");
  usePageTitle(t("privacy.title"));
  return (
    <Page title={t("privacy.title")} intro={t("privacy.intro")}>
      <Block title={t("privacy.collect")}>
        <p>
          <strong>{t("privacy.collectAdmissionLabel")}</strong>{" "}
          {t("privacy.collectAdmission")}
        </p>
        <p>
          <strong>{t("privacy.collectContactLabel")}</strong>{" "}
          {t("privacy.collectContact")}
        </p>
      </Block>
      <Block title={t("privacy.who")}>
        <p>{t("privacy.whoText")}</p>
      </Block>
      <Block title={t("privacy.payments")}>
        <p>{t("privacy.paymentsText")}</p>
      </Block>
      <Block title={t("privacy.rights")}>
        <p>
          {t("privacy.rightsText")}
          <a className="font-medium text-brand-700 underline" href="/contact">
            {t("privacy.contactPage")}
          </a>
          .
        </p>
      </Block>
      <Block title={t("privacy.keep")}>
        <p>{t("privacy.keepText")}</p>
      </Block>
    </Page>
  );
}
