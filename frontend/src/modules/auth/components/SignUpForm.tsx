import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registroConCorreo } from "../../../services/authService";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../../assets/icons";
import Label from "../../../shared/components/form/Label";
import Input from "../../../shared/components/form/input/InputField";
import Checkbox from "../../../shared/components/form/input/Checkbox";
import React from "react";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registroConCorreo(form.email, form.password);
      navigate("/usuarios");
    } catch (error) {
      alert("Error al registrar usuario");
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <a
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </a>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Sign Up
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and password to sign up!
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>First Name<span className="text-error-500">*</span></Label>
                <Input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div>
                <Label>Last Name<span className="text-error-500">*</span></Label>
                <Input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Email<span className="text-error-500">*</span></Label>
              <Input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <Label>Password<span className="text-error-500">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                className="w-5 h-5"
                checked={isChecked}
                onChange={setIsChecked}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                By creating an account you agree to the{" "}
                <span className="text-brand-600 dark:text-white">Terms</span> and{" "}
                <span className="text-brand-600 dark:text-white">Privacy Policy</span>.
              </p>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600"
            >
              Sign Up
            </button>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign In
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
