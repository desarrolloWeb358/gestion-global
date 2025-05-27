import React from "react";
import PageBreadcrumb from "../../../../shared/components/ui/PageBreadCrumb";
import UserMetaCard from "./UserMetaCard";
import UserInfoCard from "../UserProfile/UserInfoCard";
import PageMeta from "../../../../shared/components/ui/PageMeta";
import { useUsuarioActual } from "../../../auth/hooks/useUsuarioActual";
import { getAuth } from "firebase/auth";

export default function UserProfiles() {
  const { usuario, loading } = useUsuarioActual();
  const auth = getAuth();
  const photoURL = auth.currentUser?.photoURL || "/images/user/owner.jpg";
  // Puedes agregar un loader si loading
  return (
    <>
      <PageMeta
        title=""
        description=""
      />
      <PageBreadcrumb pageTitle="Profile" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Profile
        </h3>
        <div className="space-y-6">
          {usuario && (
            <UserMetaCard
              firstName={usuario.nombre?.split(" ")[0] || ""}
              lastName={usuario.nombre?.split(" ").slice(1).join(" ") || ""}
              email={usuario.email}
              phone={""}
              bio={usuario.rol}
              avatarUrl={photoURL}
              location={""}
              role={usuario.rol}
              social={{}}
            />
          )}
          <UserInfoCard />
         
        </div>
      </div>
    </>
  );
}
