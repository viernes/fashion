# -*- coding: utf-8 -*-

from odoo import models, fields, api

class product_variant_automatic(models.TransientModel):
    _name = 'product.variant.automatic'

    attribute_id = fields.Many2one('product.attribute', 'Attribute', required=True)
    data_start = fields.Char(help="Start value of the record for the sequence", required=True)
    data_end = fields.Char(help="End value of the record for the sequence", required=True)
    type =  fields.Selection([('numeric', 'Numeric'), ('alphanumeric', 'Alphanumeric')],
                                      string='Implementation', required=True, default='standard',
                                      help="Two sequence object implementations are offered: Standard "
                                           "and 'No gap'. The later is slower than the former but forbids any "
                                           "gap in the sequence (while they are possible in the former).")
    interval = fields.Integer(string='Interval', required=True, default=1,
                             help="Odoo will automatically adds some '0' on the left of the "
                                  "'Next Number' to get the required padding size.")

    prefix = fields.Char(help="Prefix value of the record for the sequence")
    suffix = fields.Char(help="Suffix value of the record for the sequence")
    padding = fields.Integer(string='Sequence Size', required=True, default=0,
                             help="Odoo will automatically adds some '0' on the left of the "
                                  "'Next Number' to get the required padding size.")

    alphanumeric_padding = fields.Char(string='Values padding', default=0,
                             help="Odoo will automatically adds some '0' on the left of the "
                                  "'Next Number' to get the required padding size.")

    def _get_data(self):
        if self.type == 'alphanumeric':
            return map(lambda x: (self.prefix or '') + str(chr(x)).rjust(self.padding, self.alphanumeric_padding) + (self.suffix or ''), range(ord(self.data_start), ord(self.data_end), int(self.interval)))
        else:
            return map(lambda x: (self.prefix or '') + str(x).rjust(self.padding, self.alphanumeric_padding) + (self.suffix or ''), range(int(self.data_start), int(self.data_end), int(self.interval)))


    @api.multi
    def do_action(self):
        if self._context.get('active_model') == 'product.template':
            templates = self.env[self._context.get('active_model')].browse(self._context.get('active_ids'))
            return templates.write({
                'attribute_line_ids':[(0,0, {
                    'attribute_id':self.attribute_id.id,
                    'value_ids':[(0,0, {
                                'name': i,
                                'attribute_id':self.attribute_id.id
                            }) for i in self._get_data()
                    ]
                })]
            })
        else:
            [self.env['product.attribute.value'].create({
                'name': i,
                'attribute_id': self.attribute_id.id
            }).id for i in self._get_data()]

            variants_action = self.env.ref('product.variants_action').read()[0]
            variants_action.update({'domain': [('attribute_id','=', self.attribute_id.id)]})
            return variants_action

