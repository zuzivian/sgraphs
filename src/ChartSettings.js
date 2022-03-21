import React, { useEffect, useState } from 'react';
import { Button, Row, Col, Form } from 'react-bootstrap';

import { getResourceNamefromID } from './utils.js';


function ChartSettings(props) {

    let [xMin, setXMin, xMax, setXMax, yMin, setYMin, yMax, setYMax] = props.domain;
    let [resourceID, setResourceID] = props.resourceID;
    let [xKey, setXKey, yKey, setYKey, series, setSeries] = props.keys;
    let [sumData, setSumData] = props.sumData;
    let [limit, setLimit] = props.limit;
    let [organisation, setOrganisation] = props.organisation;
    let filterResourceIDs = props.filterResourceIDs;
    let packages = props.packages;

    let fields = props.fields ? Object.values(props.fields).splice(1).map(item => item.id) : ['Loading...'];
    const [datasetMenu, setDatasetMenu] = useState([]);

    useEffect(() => {
        let menu = filterResourceIDs(packages, organisation);
        setDatasetMenu(menu);
    }, [organisation, props.packages, resourceID]);

    return (
        <Form className="settingsbar px-3 py-3">
            <Form.Group controlId="dataset">
                <Row><h3 className="mb-3">Dataset Selection</h3></Row>
                <Row>
                    <Col xs={4}><Form.Label>Organisation</Form.Label></Col>
                    <Col><Form.Select value={organisation} onChange={(e) => setOrganisation(e.target.value)}>
                        {props.orgList.map(key => <option key={key} value={key}>{key}</option>)}
                    </Form.Select></Col>
                </Row>
                <Row>
                    <Col xs={4}><Form.Label>Dataset</Form.Label></Col>
                    <Col><Form.Select value={resourceID} onChange={(e) => setResourceID(e.target.value)}>
                        {datasetMenu.map(key => <option key={key} value={key}>{getResourceNamefromID(props.packages, key)}</option>)}
                    </Form.Select></Col>
                </Row>
                <Row>
                    <Col xs={4}><Form.Label>No. of Entries</Form.Label></Col>
                    <Col><Form.Range value={limit} min="1000" max="10000" alt={limit} step="1000" onChange={(e) => setLimit(e.target.value)} /></Col>
                </Row>
            </Form.Group>
            <Form.Group controlId="dataset">
                <Row><h3 className="mb-3">Data Manipulation</h3></Row>
                <Row>
                    <Col xs={4}><Form.Label>X Axis</Form.Label></Col>
                    <Col><Form.Select value={xKey} onChange={(e) => setXKey(e.target.value)}>
                        {fields.map(key => <option key={key} value={key}>{key}</option>)}
                    </Form.Select></Col>
                </Row>
                <Row>
                    <Col xs={4}><Form.Label>Y Axis</Form.Label></Col>
                    <Col><Form.Select value={yKey} onChange={(e) => setYKey(e.target.value)}>
                        {fields.map(key => <option key={key} value={key}>{key}</option>)}
                    </Form.Select></Col>
                </Row>
                <Row>
                    <Col xs={4}><Form.Label>Series</Form.Label></Col>
                    <Col><Form.Select value={series} onChange={(e) => setSeries(e.target.value)}>
                        {fields.map(key => <option key={key} value={key}>{key}</option>)}
                    </Form.Select></Col>
                </Row>
                <Row>
                    <Col xs={6}><Form.Label>Sum Y-axis data entries?</Form.Label></Col>
                    <Col><Form.Check type="checkbox" checked={sumData} onChange={(e) => setSumData(!sumData)} /></Col>
                </Row>
            </Form.Group>
            <Form.Group controlId="xyAxisDomain">
                <Row><h3 className="mb-3">Chart Range</h3></Row>
                <Row>
                    <Col><Form.Text>Min X</Form.Text></Col>
                    <Col><Form.Control type="text" defaultValue={xMin} onChange={(e) => setXMin(e.target.value)} /></Col>
                    <Col><Form.Text>Max X</Form.Text></Col>
                    <Col><Form.Control type="text" defaultValue={xMax} onChange={(e) => setXMax(e.target.value)} /></Col>
                </Row>
                <Row>
                    <Col><Form.Text>Min Y</Form.Text></Col>
                    <Col><Form.Control type="text" defaultValue={yMin} onChange={(e) => setYMin(e.target.value)} /></Col>
                    <Col><Form.Text>Max Y</Form.Text></Col>
                    <Col><Form.Control type="text" defaultValue={yMax} onChange={(e) => setYMax(e.target.value)} /></Col>
                </Row>
                <Row><Form.Text>Valid inputs: a number, 'auto', 'dataMin', 'dataMax', or a string like 'dataMin - 20', 'dataMax + 100'</Form.Text></Row>
            </Form.Group>
            <Row>
                <Button target="_blank" href={"https://data.gov.sg/search?q=" + getResourceNamefromID(props.packages, resourceID)}>View on data.gov.sg</Button>
            </Row>
        </Form>
    );
}


export default ChartSettings;