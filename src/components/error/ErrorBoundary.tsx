/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { env } from '@/config/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (env.app.debugMode) {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // TODO: Send to error tracking service (Sentry, etc.)
    // if (env.services.sentry) {
    //   Sentry.captureException(error, { extra: errorInfo });
    // }

    this.setState({
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <CardTitle className="text-2xl">Oups ! Une erreur s'est produite</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>
                  {this.state.error?.message || 'Une erreur inattendue s\'est produite'}
                </AlertDescription>
              </Alert>

              <p className="text-muted-foreground">
                Nous sommes désolés pour ce désagrément. L'erreur a été enregistrée et notre
                équipe technique en a été informée.
              </p>

              {env.app.debugMode && this.state.errorInfo && (
                <details className="mt-4 p-4 bg-muted rounded-lg">
                  <summary className="cursor-pointer font-semibold mb-2">
                    Détails techniques (mode développement)
                  </summary>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">
                    {this.state.error?.stack}
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button onClick={this.handleReset} variant="default" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Réessayer
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                Retour à l'accueil
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Function component wrapper for error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
