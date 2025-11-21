import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-slate-500',
          actionButton:
            'group-[.toast]:bg-slate-900 group-[.toast]:text-slate-50',
          cancelButton:
            'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500',
          success:
            'group-[.toaster]:bg-green-50 group-[.toaster]:text-green-800 group-[.toaster]:border-green-200',
          error:
            'group-[.toaster]:bg-red-50 group-[.toaster]:text-red-800 group-[.toaster]:border-red-200',
          warning:
            'group-[.toaster]:bg-orange-50 group-[.toaster]:text-orange-800 group-[.toaster]:border-orange-200',
          info:
            'group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-800 group-[.toaster]:border-blue-200',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
