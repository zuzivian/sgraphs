import React from 'react';
import { Container } from 'react-bootstrap';

import GovDataChart from './GovDataChart';


function App() {
  return (
    <Container fluid>
      <header className="jumbotron py-2 my-2">
        <h1 className="text-center">SGraphs: a data explorer for data.gov.sg</h1>
        <h6 className="text-center">react.js visualisation tool using publicly available Singapore Government data</h6>
      </header>
      <section>
        <GovDataChart />
      </section>
      <footer className="py-2 text-center">
        Note: you may encounter errors with certain datasets due to 404 errors, or access restrictions put in place by data.gov.sg.
        <br />
        Data Visualisation by Nathaniel Wong. Contains information from datasets accessed from data.gov.sg which is made available under the terms of the Singapore Open Data Licence version 1.0.
      </footer>
    </Container >

  );
}


export default App;
