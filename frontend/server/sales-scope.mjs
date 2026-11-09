// Une première vente par numéro de série, toujours validée DEPLOYED dans Upya.
export const validatedFirstSaleSQL=(asset='a',life='l')=>`(${asset}.crm_status='DEPLOYED' AND ${life}.first_deployed_at IS NOT NULL)`;
export const firstSaleInPeriodSQL=(asset,life,start,end)=>`(${validatedFirstSaleSQL(asset,life)} AND ${life}.first_deployed_at>=${start} AND ${life}.first_deployed_at<${end})`;
