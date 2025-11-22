import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database } from "lucide-react";
import { KnowledgeUploader } from "@/components/admin/KnowledgeUploader";

const KnowledgeBase = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Base de connaissances</h1>
              <p className="text-sm text-muted-foreground">
                Gestion des DTU, normes et documents techniques
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <KnowledgeUploader />
      </main>
    </div>
  );
};

export default KnowledgeBase;
