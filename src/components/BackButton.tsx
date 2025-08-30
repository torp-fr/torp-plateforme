import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export const BackButton = ({ to = "/", label = "Retour à l'accueil", className }: BackButtonProps) => {
  return (
    <Link to={to}>
      <Button variant="outline" size="sm" className={className}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {label}
      </Button>
    </Link>
  );
};