// Imports
const cds = require("@sap/cds");

/**
 * service impl. with all service handlers
 */
module.exports = cds.service.impl(async function(){
    // define constants for the Risks and BusinessParnters entities from the risk-service.cds file
    const { Risks, BusinessPartners } = this.entities;

    /**
     * set criticality after a READ operation on /risks
     */
    this.after("READ", Risks, (data) =>{
        const risks = Array.isArray(data)? data : [data];

        risks.forEach( (risk) =>{
            if (risk.impact >= 100000 ) {
                risk.criticality = 1;
            } else if (risk.impact >= 50000 ){
                risk.criticality = 2;
            } else {
                risk.criticality = 3;
            }
        });
    });

    //connect to remote service
    const BPsrv = await cds.connect.to("API_BUSINESS_PARTNER");
/**
 *  event handler for read events on BusinessPartners Entity,
 *  each request to the API businesshub requires an apikey in the header
 */
    this.on('READ', BusinessPartners, async (req) => {
        //the API sandbox returns a lot of business patners with empty names
        // we don't want them in our application        
        req.query.where("LastName <> '' and FirstName <> '' ");

        return await BPsrv.transaction(req).send({
        // return await BPsrv.transaction(req).send({
            query: req.query,
            headers: {
                apikey: process.env.apikey,
            },
        });
    });

    /**
     * Event-handler on risks.
     * Retrieve BusinessPartner Data from the external API
     */
    this.on("READ", Risks, async (req, next) => {
        /**
         * check whether the request wants to "expand" the business partner
         * As this is not possible, the risk entity and the business partner entity are in
         * different systems,
         * if there is such expand, remove it.
         */
        if (!req.query.SELECT.columns) return next();

        const expandIndex = req.query.SELECT.columns.findIndex(
            ({expand, ref}) => expand && ref[0] == "bp"
        );
        console.log(req.query.SELECT.columns);
        if (expandIndex < 0) return next();

        req.query.SELECT.columns.splice(expandIndex, 1);
        if(
            !req.query.SELECT.columns.find( (column) =>
            column.ref.find( (ref) => ref == "bp_BusinessPartner")
            )
        ){
            req.query.SELECT.columns.push({ ref: ["bp_BusinessPartner"]});
        }

        /*
        Instead of carrying out an expand, issue a seperate request for each BP
        this code could be optimized. instead of having n requests for n BPs, 
        just one bulk requst could be created
        */
        try {
            res = await next();
            res = Array.isArray(res) ? res : [res];

            await Promise.all(
                res.map(async (risk) => {
                    const bp = await BPsrv.transaction(req).send({
                        query: SELECT.one(this.entities.BusinessPartners)
                        .where({BusinessPartner: risk.bp_BusinessPartner })
                        .columns(["BusinessPartner","LastName","FirstName"]),
                        headers:{apikey:process.env.apikey},
                    });
                    risk.bp = bp;
                })
            );
        } catch (error) {
            
        }
    });

});