const express = require('express')
const app = express()
const port = 3000
app.use(express.static('public'))
const bodyParser = require('body-parser');
app.use(bodyParser.json({ extended: true }));

let globalAdresses = [];

app.post('/address', (req, res) => {
    res.send('Hello World!')
    if (req.body.locations) {
        globalAdresses = req.body
    } else {
        console.log('nema')
    }
})

app.get('/is', (req, res) => {
    res.send(globalAdresses)
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})