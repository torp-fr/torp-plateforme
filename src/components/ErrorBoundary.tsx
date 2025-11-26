import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-2xl">Une erreur est survenue</CardTitle>
                  <CardDescription>
                    L'application a rencontré un problème et doit être rechargée
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 p-4 rounded-lg">
                <p className="font-medium text-sm mb-2">Message d'erreur :</p>
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                  {this.state.error?.toString()}
                </pre>
              </div>

              {this.state.errorInfo && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium mb-2">
                    Détails techniques (pour debug)
                  </summary>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReload} className="flex-1">
                  Recharger la page
                </Button>
                <Button onClick={this.handleClearStorage} variant="outline" className="flex-1">
                  Vider le cache et recharger
                </Button>
              </div>

              <div className="bg-muted p-3 rounded text-xs">
                <p className="font-medium mb-2">💡 Si le problème persiste :</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Videz complètement le cache du navigateur (Ctrl+Shift+Delete)</li>
                  <li>Essayez en mode navigation privée</li>
                  <li>Vérifiez la console JavaScript (F12)</li>
                  <li>Contactez le support technique</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
