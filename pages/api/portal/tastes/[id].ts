import { withSupportPortalApi } from "../../../../lib/admin/access";
import { deleteCatalogAsset } from "../../../../services/server/deleteCatalogAsset";
const handler = deleteCatalogAsset("tastes");
export default withSupportPortalApi(handler);
