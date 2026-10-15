import { withSupportPortalApi } from "../../../../lib/admin/access";
import { deleteCatalogAsset } from "../../../../services/server/deleteCatalogAsset";
const handler = deleteCatalogAsset("brands");
export default withSupportPortalApi(handler);
