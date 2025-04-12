import PageMeta from "../../../components/ui/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "./SignInForm";
import React from "react";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Gestion Global"
        description=""
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
