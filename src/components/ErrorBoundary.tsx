import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary que captura errores en el árbol de componentes hijos.
 * Previene que un error en un componente tumbe toda la aplicación.
 *
 * Uso:
 *   <ErrorBoundary fallback={<p>Algo salió mal</p>}>
 *     <ComponentePotencialmenteRoto />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción, aquí se enviaría a Sentry o similar
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Algo salió mal
            </h2>
            <p className="text-gray-600 mb-1 text-sm">
              {this.state.error?.message || 'Error inesperado en la aplicación.'}
            </p>
            <p className="text-gray-400 text-xs mb-6">
              Si el problema persiste, recargá la página.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Reintentar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC para envolver componentes de página con un Error Boundary.
 * Uso: export default withErrorBoundary(MiPagina);
 */
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: React.ReactNode
) {
  const displayName = Component.displayName || Component.name || 'Component';

  const Wrapped = (props: T) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  Wrapped.displayName = `withErrorBoundary(${displayName})`;
  return Wrapped;
}
