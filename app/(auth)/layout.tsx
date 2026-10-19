import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-[calc(100vh-30px)] place-items-center p-5"><div className="w-full max-w-md"><div className="mb-8 text-center"><Logo /></div>{children}</div></main>;
}
