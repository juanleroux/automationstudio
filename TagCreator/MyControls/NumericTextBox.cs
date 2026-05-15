using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace MyControls
{
    public class NumericTextBox : TextBox
    {
        private string _decimalSeparator;
        private string _groupSeparator;
        private string _negativeSign;

        public NumericTextBox()
        {
            DataObject.AddPastingHandler(this, OnPaste);

            NumberFormatInfo numberFormatInfo = System.Globalization.CultureInfo.CurrentCulture.NumberFormat;
            _decimalSeparator = "."; // numberFormatInfo.NumberDecimalSeparator;
            _groupSeparator = numberFormatInfo.NumberGroupSeparator;
            _negativeSign = numberFormatInfo.NegativeSign;      
      
            this.MaxLength = 10;
            this.MaxValue = 2147483647;
        }

        #region Attributes

        public double MinValue
        {
            get;
            set;
        }

        public double MaxValue
        {
            get;
            set;
        }

        #endregion

        protected override void OnPreviewTextInput(System.Windows.Input.TextCompositionEventArgs e)
        {
            base.OnPreviewTextInput(e);

            if (string.IsNullOrEmpty(e.Text))
                return;

            //check for valid chars, disable input if not found
            if (Char.IsDigit(Convert.ToChar(e.Text)) || e.Text.Equals(_decimalSeparator) || e.Text.Equals(_groupSeparator) || e.Text.Equals(_negativeSign))                
            {                
                string text = string.Empty;
                if (this.SelectionLength > 0)
                    text = this.Text.Replace(this.SelectedText, e.Text);
                else
                    text = this.Text.Insert(this.SelectionStart, e.Text);

                if (text.Length > 0)
                {
                    double d;
                    if (double.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out d) == false && text != _negativeSign)
                        e.Handled = true;                    
                }
            }
            else
                e.Handled = true;            
        }

        protected override void OnPreviewKeyDown(System.Windows.Input.KeyEventArgs e)
        {
            base.OnPreviewKeyDown(e);

            if (e.Key == Key.Space)
                e.Handled = true;            
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);

            if (e.Key == Key.Return)
            {
                FocusNavigationDirection focusDirection = FocusNavigationDirection.Next;

                // MoveFocus takes a TraveralReqest as its argument.
                TraversalRequest request = new TraversalRequest(focusDirection);

                // Gets the element with keyboard focus.
                UIElement elementWithFocus = Keyboard.FocusedElement as UIElement;

                // Change keyboard focus.
                if (elementWithFocus != null)
                {
                    if (elementWithFocus.MoveFocus(request)) e.Handled = true;
                }
            }
        }

        protected override void OnLostFocus(RoutedEventArgs e)
        {
            base.OnLostFocus(e);

            double val = 0;
            double.TryParse(this.Text, NumberStyles.Any, CultureInfo.InvariantCulture, out val);

            //check limits
            if (val < MinValue)
                val = MinValue;

            if (val > MaxValue)
                val = MaxValue;

            this.Text = val.ToString(CultureInfo.InvariantCulture);
        }

        private void OnPaste(object sender, DataObjectPastingEventArgs e)
        {            
            var isText = e.SourceDataObject.GetDataPresent(DataFormats.UnicodeText, true);
            if (isText == false)
            {
                e.CancelCommand();
                return;
            }

            string text = e.SourceDataObject.GetData(DataFormats.UnicodeText) as string;

            if (text.Length > this.MaxLength)
            {
                e.CancelCommand();
                return;
            }

            double val = 0;
            if (double.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out val) == false)
            {
                e.CancelCommand();
                return;
            }
        }
    }
}
