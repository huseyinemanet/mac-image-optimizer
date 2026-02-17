import { createContext, useContext, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';

type ToastKind = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastApi {
  notify: (title: string, description?: string, type?: ToastKind, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

function ToastLayer({ children }: { children: React.ReactNode }): JSX.Element {
  const api = useMemo<ToastApi>(
    () => ({
      notify: (title, description, type = 'info', action) => {
        const content = (
          <div className="flex items-center gap-2">
            <div className="truncate text-xs text-slate-700">{description ? `${title}: ${description}` : title}</div>
            {action ? (
              <button className="shrink-0 text-xs font-medium text-blue-700 hover:underline" onClick={action.onClick}>
                {action.label}
              </button>
            ) : null}
          </div>
        );

        if (type === 'success') {
          toast.success(content, { duration: 2800 });
          return;
        }

        if (type === 'error') {
          toast.error(content, { duration: 3200 });
          return;
        }

        toast(content, { duration: 2800 });
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster
        position="top-right"
        containerStyle={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 50
        }}
        toastOptions={{
          className: 'max-w-[360px]',
          style: {
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: '#fff',
            color: '#0f172a',
            padding: '8px 10px',
            boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)'
          }
        }}
      />
    </ToastContext.Provider>
  );
}

export function ToastHost({ children }: { children: React.ReactNode }): JSX.Element {
  return <ToastLayer>{children}</ToastLayer>;
}

export function useToastHost(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastHost must be used inside ToastHost');
  }
  return context;
}
