import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, BarChart3, Shield, CheckCircle } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

export const Hero = () => {
  return (
    <section className="relative bg-gradient-hero text-white py-20 overflow-hidden">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <Badge variant="outline" className="bg-white/10 text-white border-white/30">
                🏗️ Secteur des Travaux
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Analysez vos <span className="text-white/90">devis</span> en toute transparence
              </h1>
              <p className="text-xl text-white/90 leading-relaxed">
                TORP utilise l'intelligence artificielle pour évaluer la qualité de vos devis, 
                vous aider dans vos décisions et valoriser l'expertise des entreprises.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90">
                <Upload className="mr-2 h-5 w-5" />
                Analyser un devis
              </Button>
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                Voir la démo
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-8">
              <div className="text-center">
                <div className="text-3xl font-bold">A-E</div>
                <div className="text-sm text-white/80">Notation claire</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">24h</div>
                <div className="text-sm text-white/80">Analyse rapide</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">100%</div>
                <div className="text-sm text-white/80">Transparent</div>
              </div>
            </div>
          </div>

          <div className="relative animate-fade-in">
            <img 
              src={heroImage} 
              alt="Analyse de devis TORP" 
              className="rounded-lg shadow-strong"
            />
            <div className="absolute -bottom-6 -left-6 bg-white rounded-lg p-4 shadow-medium">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <div className="font-semibold text-foreground">Devis validé</div>
                  <div className="text-sm text-muted-foreground">Note A - Excellent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};