import { LoginForm } from "@/components/login-form"
import Waves from "@/components/Waves"

export function LoginPage() {
  return (
    <div className="relative bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <Waves
        lineColor="hsl(0, 0%, 85%)"
        waveSpeedX={0.0125}
      />
      <div className="relative z-10 w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  )
}