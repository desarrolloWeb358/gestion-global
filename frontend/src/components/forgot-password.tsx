"use client"
import { useState } from "react"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Link } from "react-router-dom"
import { resetPassword } from "../services/authService"


export default function ResetPasswordForm () {
    const [email, setEmail] = useState("")
    const [mensaje, setMensaje] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMensaje("")
        setError("")
        setLoading(true)
        try {
            await resetPassword(email.trim())
            setMensaje("Revisa tu correo para restablecer tu contraseña.")
        } catch (err: any) {
            setError("No se pudo enviar el enlace. Verifica tu correo.")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 dark:bg-gray-950">
            <div className="mx-auto w-full max-w-md space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
                        Olvidaste tu contraseña?
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Ingresa tu correo asociado con tu cuenta y te enviaremos un link para resetear tu contrasena.
                    </p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <Label htmlFor="email" className="sr-only">
                            Email
                        </Label>
                        <Input id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="Email"
                            onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Enviando..." : "Restablecer contraseña"}
                    </Button>
                </form>
                {mensaje && <p className="text-green-600 text-sm text-center">{mensaje}</p>}
                {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                <div className="flex justify-center">
                    <Link
                        to="/signIn"
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
                    >
                       volver al login
                    </Link>
                </div>
            </div>
        </div>
    )
}