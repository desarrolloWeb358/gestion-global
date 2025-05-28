import PageMeta from "../../../shared/components/ui/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "./SignInForm";


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
