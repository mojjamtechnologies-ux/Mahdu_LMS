import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { schoolNameOf } from "../i18n";

export function usePageTitle(title: string) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const schoolName = schoolNameOf(i18n.language);
    document.title = title ? `${title} | ${schoolName}` : schoolName;
  }, [title, i18n.language]);
}
