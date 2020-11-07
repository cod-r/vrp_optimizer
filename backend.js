const express = require('express')
var cors = require('cors')
const app = express()
const port = 3000
app.use(express.static('public'))
const bodyParser = require('body-parser');
app.use(bodyParser.json({extended: true}));
app.use(cors())
let globalDistanceMatrix = [];

app.post('/delivery', (req, res) => {
    res.send(['success'])
    if (req.body.durations) {
        globalDistanceMatrix = req.body
    } else {
        console.log('nema')
    }
})

app.get('/distance_matrix', (req, res) => {

    res.send(globalDistanceMatrix)

})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})