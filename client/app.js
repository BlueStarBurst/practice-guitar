//lots of imports
import React, { useEffect, useRef, useState } from 'react'
import { render } from 'react-dom'

import Button from './elements/button'
import "./style.css"


function App() {



    return (<div className="flexContainer">
        <Button color="blue">CREATE A NEW TAB</Button>
        <Button color="red">PLAY A SAVED TAB</Button>
    </div>);
}

render(<App />, document.getElementById("root"));