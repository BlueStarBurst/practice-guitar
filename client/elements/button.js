import React, { useEffect, useRef, useState } from 'react'
import "./button.css"

export default function Button(props) {

    const style = {
        width: "80vw",
        height: "80vw",
        maxHeight: "250px",
        maxWidth: "200px",
        margin: "1%",
        borderRadius: "15px",
        display: "flex",
        textAlign: "center"
    }

    const mar = {
        margin: "auto"
    }

    return (<div className={`button ${props.color}`} style={style}>
        <p style={mar}>{props.children}</p>
    </div>)
}

Button.defaultProps = ({
    color: "blue"
});