import { ResponsiveContainer, LineChart, Label, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

import { parseFloatOrText } from './utils.js';


function SimpleLineChart(props) {

    let [xMin, xMax, yMin, yMax] = props.domain;

    function getRandomDarkColor() {
        let color = "#";
        for (let i = 0; i < 6; i++) {
            color += Math.floor(Math.random() * 10);
        }
        return color;
    }

    function isAxisNumerical(key) {
        if (!props.dataset || !Object.keys(props.dataset)[0]) return false;
        let first_series = Object.keys(props.dataset)[0];
        let val = props.dataset[first_series][0][key];
        if (!val) return false;
        return /^-?\d*(\.\d+)?$/.test(val);
    }

    if (props.error) return <div>Error: {props.error.message}</div>;
    if (!props.isLoaded) return <div>Loading Data...</div>;

    return (
        <ResponsiveContainer width="100%" height={600}>
            <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type={isAxisNumerical(props.xKey) ? "number" : "category"} dataKey={props.xKey} domain={[parseFloatOrText(xMin), parseFloatOrText(xMax)]}>
                    <Label value={props.xKey} position="insideBottom" />
                </XAxis>
                <YAxis type={isAxisNumerical(props.yKey) ? "number" : "category"} domain={[parseFloatOrText(yMin), parseFloatOrText(yMax)]}>
                    <Label value={props.yKey} angle={-90} position="insideLeft" />
                </YAxis>
                <Tooltip filterNull="true" itemStyle={{ fontSize: '0.7em', padding: 0 }} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: '0.5em' }} />
                {Object.keys(props.dataset).map(key => (
                    <Line type="natural" legendType="square" activeDot={{ r: 6 }} dataKey={props.yKey} data={props.dataset[key]} name={key} key={key} stroke={getRandomDarkColor()} />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );

}

export default SimpleLineChart;