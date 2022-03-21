import React, { useEffect, useState } from 'react';
import { Row, Col } from 'react-bootstrap';
import _ from 'underscore';

import ChartSettings from './ChartSettings';
import SimpleLineChart from './SimpleLineChart';
import { parseFloatOrText, isFloatOrInt, computeLabels, filterResourceIDs } from './utils.js';


function GovDataChart(props) {
    const [packages, setPackages] = useState([]);
    const [orgList, setOrgList] = useState([]);
    const [organisation, setOrganisation] = useState('');
    const [resourceID, setResourceID] = useState('');
    const [error, setError] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [result, setResult] = useState([]);
    const [sumData, setSumData] = useState(true);
    const [limit, setLimit] = useState('2000');
    const [xMin, setXMin] = useState('auto');
    const [xMax, setXMax] = useState('auto');
    const [yMin, setYMin] = useState('auto');
    const [yMax, setYMax] = useState('auto');
    const [xKey, setXKey] = useState('');
    const [yKey, setYKey] = useState('');
    const [series, setSeries] = useState('');
    const [dataset, setDataset] = useState([]);

    // retrieve package list when page loads.
    useEffect(() => {
        setIsLoaded(false);
        let url = "https://data.gov.sg/api/action/datastore_search?resource_id=85be5dcc-93f6-4d36-ae10-c85b0907948c&limit=10000";
        fetch(url).then(res => res.json()).then((res) => {
            setError(null);
            let filteredPackages = res.result.records.filter(item => item.resource_format === 'CSV');
            setPackages(filteredPackages);
            let newOrgList = [...new Set(filteredPackages.map(item => item.organisation))].sort()
            setOrgList(newOrgList);
            let newOrg = newOrgList[Math.floor(Math.random() * newOrgList.length)];
            setOrganisation(newOrg);

        });
    }, []);

    // update datasets whenever there is a change in organisation selection
    useEffect(() => {
        let resourceIDs = filterResourceIDs(packages, organisation);
        let newResourceID = resourceIDs[Math.floor(Math.random() * resourceIDs.length)];
        setResourceID(newResourceID);
    }, [packages, organisation]);

    // retrieve dataset based on resourceID
    useEffect(() => {
        if (!resourceID) return;
        let url = "https://data.gov.sg/api/action/datastore_search?";
        url += "&limit=" + limit;
        url += "&resource_id=" + resourceID;
        fetch(url).then(res => res.json()).then(
            (res) => {
                if (!res.success) {
                    setError({ message: "API error, resource not available" });
                }
                else {
                    // store result
                    setError(null);
                    setResult(res.result);
                    let [x, y, series] = computeLabels(res.result.fields, res.result.records);
                    setXKey(x); setYKey(y); setSeries(series);
                }
                setIsLoaded(true);
            },
            (error) => {
                setError(error);
            }
        );
    }, [resourceID, limit, organisation]);

    // error handling
    useEffect(() => {
        if (error && !isLoaded) {
            let newOrg = orgList[Math.floor(Math.random() * orgList.length)];
            setOrganisation(newOrg);
        }
    }, [error])

    // update datasets whenever there are changes to the parameters
    useEffect(() => {
        if (!result || !result.records) return;
        let sorted_records = result.records.sort((a, b) => a[xKey] > b[xKey]);

        setDataset(regroupDataset(sumData, sorted_records, series));
    }, [sumData, result, series, xKey, yKey]);

    function regroupDataset(sumData, records, series_name) {
        // if we aren't summing data, a GroupBy opreation will suffice
        if (!sumData) return _.groupBy(records, series_name);

        let dataset = {};
        for (let i = 0; i < records.length; i++) {
            let item = records[i];
            let seriesID = item[series_name];
            if (!dataset[seriesID]) {
                // series doesnt exist yet, insert first data point
                dataset[seriesID] = [{ [xKey]: item[xKey], [yKey]: parseFloatOrText(item[yKey]) }];
                continue;
            }
            // series exists,  check if xKey exists in series
            let found = false;
            for (const j in dataset[seriesID]) {
                if (dataset[seriesID][j][xKey] === item[xKey]) {
                    found = true;
                    if (!isFloatOrInt(item[yKey])) continue;                         // item is NaN, don't even bother with it
                    if (!isFloatOrInt(dataset[seriesID][j][yKey])) {
                        dataset[seriesID][j][yKey] = parseFloatOrText(item[yKey]);  // replace NaN with number if possible
                    } else {
                        dataset[seriesID][j][yKey] += parseFloatOrText(item[yKey]);   // both are numbers, add y Values together
                    }
                }
            }
            if (!found) dataset[seriesID].push({ [xKey]: item[xKey], [yKey]: parseFloatOrText(item[yKey]) });   // x-key doesn't exist, push it to dataset
        }
        return dataset;
    }

    return (
        <Row>
            <Col xs={12} md={6} lg={8}>
                <SimpleLineChart
                    isLoaded={isLoaded}
                    error={error}
                    dataset={dataset}
                    xKey={xKey}
                    yKey={yKey}
                    domain={[xMin, xMax, yMin, yMax]}
                />
            </Col>
            <Col xs={12} md={6} lg={4}>
                <ChartSettings
                    keys={[xKey, setXKey, yKey, setYKey, series, setSeries]}
                    domain={[xMin, setXMin, xMax, setXMax, yMin, setYMin, yMax, setYMax]}
                    resourceID={[resourceID, setResourceID]}
                    fields={result ? result.fields : []}
                    sumData={[sumData, setSumData]}
                    limit={[limit, setLimit]}
                    packages={packages}
                    orgList={orgList}
                    organisation={[organisation, setOrganisation]}
                    filterResourceIDs={filterResourceIDs}
                />
            </Col>

        </Row>
    );
}

export default GovDataChart;