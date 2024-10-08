const { Gateway } = require('../../fake/controller/testController');
const logger = require('../../configs/pino_logger');
const EnterpriseStateLocationModel = require('../../models/enterprise_state_location.model');
const OGConfigs = require('../../models/OGConfig.model');
const moment = require('moment-timezone');
const mongoose = require('mongoose');


exports.SendAudit = async (req) => {
    try {
        logger.info("Delloite-EnergyMeter-Data", req);
        return {
            success: true,
            status: 200,
            message: "Audit sent successfully",
            data: { /* any additional data you want to include */ }
        };
    } catch (err) {
        console.log(err.message);
        // Assuming `req` has a `res` object, otherwise remove `res` handling
        if (req) {
            return req.res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
        } else {
            // If there's no `res`, just throw the error
            throw err;
        }
    }
};
exports.SendAmbientAudit = async (req) => {
    try {
        logger.info("Delloite-Ambient-Info", req);
        return {
            success: true,
            status: 200,
            message: "Audit sent successfully",
            data: { /* any additional data you want to include */ }
        };
    } catch (err) {
        console.log(err.message);
        // Assuming `req` has a `res` object, otherwise remove `res` handling
        if (req) {
            return req.res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
        } else {
            // If there's no `res`, just throw the error
            throw err;
        }
    }
};
exports.InfoPassGateway = async (req) => {
    try {

        const lastRunRecord = await OGConfigs.findOne().sort({ runId: -1 });
        const runId = lastRunRecord && !isNaN(Number(lastRunRecord.runId)) ? Number(lastRunRecord.runId) + 1 : 1;

        // Convert the string to ObjectId
        const enterpriseId = new mongoose.Types.ObjectId(req.EnterpriseInfo);

        // Perform the HTTP call or any other action here
        const result = await EnterpriseStateLocationModel.findOne({ _id: enterpriseId })
            .populate({
                path: 'State_ID', // Populates the State_ID field
                select: 'name'    // Only selects the 'name' field from the State document
            })
            .exec();

        const newRecord = {
            GatewayID: req.GatewayID,
            runId: runId,  // Add the calculated runId      
            Location: result.LocationName, // Fixed field usage for location
            Lat: result.Lat,
            Long: result.Long,
            State: result.State_ID.name, // Use populated 'name' field from State_ID
            OnboardingDate: req.OnboardingDate,
            Switch: false,
            Time: moment().tz('Asia/Kolkata').format(),  // Current timestamp in IST
            Action: req.Action,
            Type: "Gateway",
        };

        // Create and save the new record in OGConfigs model
        const newConfig = new OGConfigs(newRecord);
        // await newConfig.save();
        console.log({ newConfig });

        const humanReadableTime = moment(newConfig.Time).format('YYYY-MM-DD HH:mm:ss'); // Adjust format as needed

        const humanReadableCreatedAt = moment(newConfig.createdAt).format('YYYY-MM-DD HH:mm:ss'); // Adjust format as needed
        // Log the new config details
        logger.info("Delloite-GatewayConfig-Data", {
            GroupMsgId: newConfig.runId,
            Messages: [{
                MessageId: newConfig._id,
                GatewayID: newConfig.GatewayID,
                Location: newConfig.Location, // Corrected location usage
                Lat: newConfig.Lat,
                Long: newConfig.Long,
                State: newConfig.State,
                OnboardingDate: newConfig.OnboardingDate,
                Switch: newConfig.Switch,
                Time: humanReadableTime,
                MessageTime: humanReadableCreatedAt,
                Action: newConfig.Action,
                Type: newConfig.Type
            }]
        });

    } catch (err) {
        logger.error("InfoPassGateway", {
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};
exports.InfoPassOptimizer = async (req) => {
    try {
        const lastRunRecord = await OGConfigs.findOne().sort({ runId: -1 });
        const runId = lastRunRecord && !isNaN(Number(lastRunRecord.runId)) ? Number(lastRunRecord.runId) + 1 : 1;
        const newRecord = {
            runId: runId,
            OptimizerId: req.OptimizerID,
            GatewayID: req.GatewayId,
            Details: {
                ACTonnage: req.ACTonnage,
                AC_Energy: req.AC_Energy,
            },
            Time: moment().tz('Asia/Kolkata').format(),
            Action: req.Action,
            Type: "Optimizer"
        }
        const newConfig = new OGConfigs(newRecord);
        // await newConfig.save();
        // console.log({ newConfig });
        const humanReadableTime = moment(newConfig.Time).format('YYYY-MM-DD HH:mm:ss'); // Adjust format as needed

        const humanReadableCreatedAt = moment(newConfig.createdAt).format('YYYY-MM-DD HH:mm:ss'); // Adjust format as needed
        // Log the new config details
        logger.info("Delloite-OptimizerConfig-Data", {
            GroupMsgId: newConfig.runId,
            Messages: [{
                MessageId: newConfig._id,
                GatewayID: newConfig.GatewayID,
                OptimizerId: newConfig.OptimizerId,
                Details: {
                    ACTonnage: newConfig.Details.ACTonnage,
                    AC_Energy: newConfig.Details.AC_Energy,
                },
                Time: humanReadableTime,
                MessageTime: humanReadableCreatedAt,
                Action: newConfig.Action,
                Type: newConfig.Type
            }]
        });
    } catch (err) {
        console.error(err.message); // More appropriate error logging
        console.log({
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};
