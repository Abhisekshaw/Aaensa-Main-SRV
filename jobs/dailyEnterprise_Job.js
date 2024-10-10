const EnterpriseDetailsModel = require('../models/enterpriseDetails');
const EnterpriseModel = require('../models/enterprise.model');
const moment = require('moment');
const logger = require('../configs/pino_logger');

module.exports = function (agenda) {
    console.log('_____----------');
    
    agenda.define('dailyEnterprise_Job', async (job) => {
        console.log("job is running")

        try {
            const nextRunOptAggJob = await agenda.jobs({ name: 'dailyEnterprise_Job' }, { nextRunAt: 1 });
            const startTime = nextRunOptAggJob[0].attrs.lastRunAt;
            const endTime = nextRunOptAggJob[0].attrs.nextRunAt;

            // 2. Get the current data from the DailyEnterpriseUpdate function
            const AllData = await DailyEnterpriseUpdate(startTime, endTime);
            // const AllData = await DailyEnterpriseUpdate();
            
            // 4. Insert new records into EnterpriseDetailsModel
            await EnterpriseDetailsModel.insertMany(AllData.map(record => ({
                enterpriseId: record.entepriseId,
                enterprisename: record.enterprisename,
                stateId: record.stateId,
                statename: record.state,
                locationId: record.locationId,
                locationname: record.location,
                gatewayId: record.gatewayId,
                gatewayname: record.gateway,
                optimizerId: record.optimizerId,
                optimizername: record.optimizerName,
            })));
        } catch (err) {

        }
    });

    async function DailyEnterpriseUpdate(startTime, endTime) {
        const pipeline = [
            // Lookup for enterprisestates
            {
                $lookup: {
                    from: "enterprisestates",
                    localField: "_id",
                    foreignField: "Enterprise_ID",
                    as: "stateData"
                }
            },
            {
                $unwind: {
                    path: "$stateData",
                    preserveNullAndEmptyArrays: true // Allow null or missing data
                }
            },
            // Lookup for enterprisestatelocations
            {
                $lookup: {
                    from: "enterprisestatelocations",
                    localField: "stateData.Enterprise_ID",
                    foreignField: "Enterprise_ID",
                    as: "locationData"
                }
            },
            {
                $unwind: {
                    path: "$locationData",
                    preserveNullAndEmptyArrays: true // Allow null or missing data
                }
            },
            {
                $match: {
                    $expr: {
                        $eq: [
                            "$locationData.State_ID",
                            "$stateData.State_ID"
                        ]
                    }
                }
            },
            // Lookup for states
            {
                $lookup: {
                    from: "states",
                    localField: "stateData.State_ID",
                    foreignField: "_id",
                    as: "stateInfo"
                }
            },
            {
                $unwind: {
                    path: "$stateInfo",
                    preserveNullAndEmptyArrays: true // Allow null or missing data
                }
            },
            // Lookup for gateways
            {
                $lookup: {
                    from: "gateways",
                    localField: "locationData._id",
                    foreignField: "EnterpriseInfo",
                    as: "gatewayInfo"
                }
            },
            {
                $unwind: {
                    path: "$gatewayInfo",
                    preserveNullAndEmptyArrays: true // Allow null or missing data
                }
            },
            // Match for gateways within the specified time range
            {
                $match: {
                    $or: [
                        { "gatewayInfo.createdAt": { $gte: new Date(startTime), $lte: new Date(endTime) } },
                        { "gatewayInfo.updatedAt": { $gte: new Date(startTime), $lte: new Date(endTime) } }
                    ]
                }
            },
            // Lookup for optimizers
            {
                $lookup: {
                    from: "optimizers",
                    localField: "gatewayInfo._id",
                    foreignField: "GatewayId",
                    as: "optimizerInfo"
                }
            },
            {
                $unwind: {
                    path: "$optimizerInfo",
                    preserveNullAndEmptyArrays: true // Allow null or missing data
                }
            },
            // Match for optimizers based on the gateway change status
            {
                $match: {
                    $or: [
                        // If gateway has changed, include all optimizers
                        {
                            $or: [
                                {
                                    "gatewayInfo.createdAt": { $gte: new Date(startTime), $lte: new Date(endTime) }
                                },
                                {
                                    "gatewayInfo.updatedAt": { $gte: new Date(startTime), $lte: new Date(endTime) }
                                }
                            ]
                        },
                        // If gateway hasn't changed, only include optimizers that have changed
                        {
                            $nor: [
                                {
                                    $or: [
                                        {
                                            "gatewayInfo.createdAt": { $gte: new Date(startTime), $lte: new Date(endTime) }
                                        },
                                        {
                                            "gatewayInfo.updatedAt": { $gte: new Date(startTime), $lte: new Date(endTime) }
                                        }
                                    ]
                                }
                            ],
                            $or: [
                                { "optimizerInfo.createdAt": { $gte: new Date(startTime), $lte: new Date(endTime) } },
                                { "optimizerInfo.updatedAt": { $gte: new Date(startTime), $lte: new Date(endTime) } }
                            ]
                        }
                    ]
                }
            },
            // Project the desired fields
            {
                $project: {
                    _id: 0,
                    enterpriseId: "$_id",
                    enterpriseName: "$EnterpriseName",
                    stateId: "$stateData.State_ID",
                    state: "$stateInfo.name",
                    locationId: "$locationData._id",
                    location: "$locationData.LocationName",
                    gatewayId: "$gatewayInfo._id",
                    gateway: "$gatewayInfo.GatewayID",
                    optimizerId: "$optimizerInfo._id",
                    optimizerName: "$optimizerInfo.OptimizerName",
                    createdAt: "$optimizerInfo.createdAt",
                    updatedAt: "$optimizerInfo.updatedAt"
                }
            }
        ];
    
        const data = await EnterpriseModel.aggregate(pipeline).exec();
        return data;
    }

// async function DailyEnterpriseUpdate() {
//     const pipeline =
//     [
//       {
//         $lookup: {
//           from: "enterprisestates",
//           localField: "_id",
//           foreignField: "Enterprise_ID",
//           as: "stateData"
//         }
//       },
//       {
//         $unwind: {
//           path: "$stateData",

//         }
//       },
//       {
//         $lookup: {
//           from: "enterprisestatelocations",
//           localField: "stateData.Enterprise_ID",
//           foreignField: "Enterprise_ID",
//           as: "locationData"
//         }
//       },
//       {
//         $unwind: {
//           path: "$locationData"
//         }
//       },
//       {
//         $match: {
//           $expr: {
//             $eq: [
//               "$locationData.State_ID",
//               "$stateData.State_ID"
//             ]
//           }
//         }
//       },
//       {
//         $lookup: {
//           from: "states",
//           localField: "stateData.State_ID",
//           foreignField: "_id",
//           as: "stateInfo"
//         }
//       },
//       {
//         $unwind: {
//           path: "$stateInfo"
//         }
//       },
//       {
//         $lookup: {
//           from: "gateways",
//           localField: "locationData._id",
//           foreignField: "EnterpriseInfo",
//           as: "gatewayInfo"
//         }
//       },
//       {
//         $unwind: {
//           path: "$gatewayInfo"
//         }
//       },
//       {
//         $lookup: {
//           from: "optimizers",
//           localField: "gatewayInfo._id",
//           foreignField: "GatewayId",
//           as: "optimizerInfo"
//         }
//       },
//       {
//         $unwind: {
//           path: "$optimizerInfo",
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           entepriseId: "$_id",
//           enterprisename: "$EnterpriseName",
//           stateId: "$stateData.State_ID",
//           state: "$stateInfo.name",
//           locationId: "$locationData._id",
//           location: "$locationData.LocationName",
//           gatewayId: "$gatewayInfo._id",
//           gateway: "$gatewayInfo.GatewayID",
//           optimizerId: "$optimizerInfo._id",
//           optimizername: "$optimizerInfo.OptimizerName",

//         }
//       }
//     ]
//     const data = await EnterpriseModel.aggregate(pipeline).exec();
//     return data;
// }
};
