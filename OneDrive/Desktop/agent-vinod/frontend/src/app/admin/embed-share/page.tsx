import { redirect } from "next/navigation";

export default function AdminEmbedShareRedirect() {
  redirect("/admin/products");
}
