import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TellerSettings from "./TellerSettings";
import CategoryManager from "../Categories/CategoryManager";
import CsvImport from "../Import/CsvImport";
import { Sun, Moon } from "lucide-react";
import { getTheme, toggleTheme } from "@/lib/theme";

export default function SettingsPage() {
  const [tab, setTab] = useState("general");
  const [theme, setTheme] = useState(getTheme);

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="teller">Teller</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="general" activeValue={tab}>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Switch between dark and light mode
                </p>
              </div>
              <button
                onClick={handleThemeToggle}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors text-sm"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" /> Dark Mode
                  </>
                )}
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teller" activeValue={tab}>
          <TellerSettings />
        </TabsContent>

        <TabsContent value="categories" activeValue={tab}>
          <CategoryManager />
        </TabsContent>

        <TabsContent value="import" activeValue={tab}>
          <CsvImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
