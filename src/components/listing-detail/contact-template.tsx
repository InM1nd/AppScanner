"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useTranslations } from "@/i18n/locale-context";

function buildTemplates(
  title: string,
  rooms: number | null,
  squareMeters: number | null,
) {
  const size =
    rooms || squareMeters
      ? ` (${[rooms ? `${rooms} rooms` : null, squareMeters ? `${squareMeters} m²` : null].filter(Boolean).join(", ")})`
      : "";
  return {
    en: `Hello,\n\nI'm very interested in your apartment "${title}"${size}. Is it still available? I would like to arrange a viewing if possible — I'm flexible on timing.\n\nA few quick questions: what is the earliest move-in date, and are the operating costs and heating included in the price shown?\n\nThank you very much,\n[Your name]`,
    de: `Guten Tag,\n\nich interessiere mich sehr für Ihre Wohnung "${title}"${size}. Ist diese noch verfügbar? Ich würde mich gerne für eine Besichtigung anmelden — zeitlich bin ich flexibel.\n\nKurze Fragen: Was ist der früheste Einzugstermin, und sind Betriebskosten und Heizung im angegebenen Preis enthalten?\n\nVielen Dank und freundliche Grüße,\n[Ihr Name]`,
  };
}

export function ContactTemplate({
  title,
  rooms,
  squareMeters,
}: {
  title: string;
  rooms: number | null;
  squareMeters: number | null;
}) {
  const { t } = useTranslations();
  const templates = buildTemplates(title, rooms, squareMeters);
  const [lang, setLang] = useState<"en" | "de">("en");

  async function copy() {
    await navigator.clipboard.writeText(templates[lang]);
    toast.success(t("common.copied"));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t("listingDetail.contactTemplate")}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="size-3.5" /> {t("common.copy")}
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={lang} onValueChange={(v) => setLang(v as "en" | "de")}>
          <TabsList>
            <TabsTrigger value="en">English</TabsTrigger>
            <TabsTrigger value="de">Deutsch</TabsTrigger>
          </TabsList>
          <TabsContent value="en">
            <p className="whitespace-pre-wrap text-sm mt-2">{templates.en}</p>
          </TabsContent>
          <TabsContent value="de">
            <p className="whitespace-pre-wrap text-sm mt-2">{templates.de}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
